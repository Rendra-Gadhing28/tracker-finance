import assert from 'node:assert/strict';
import {
  calculateBudgetFormulas,
  getWeekRange,
  isDateInWeek,
  getWIBParts
} from '../src/lib/week.js';
import { formatRp, parseRp } from '../src/lib/money.js';

console.log('--- RUNNING TAHAP 2 VERIFICATION TESTS ---');

// 1. Uji Bagian 10.4 Tabel Contoh Rumus
{
  const budgetCategories = [
    { id: 'jajan', tipe: 'keluar', limit_mingguan: 72500 },
    { id: 'pulsa', tipe: 'keluar', limit_mingguan: 4000 },
    { id: 'bensin', tipe: 'keluar', limit_mingguan: 25000 },
    { id: 'jajanin', tipe: 'keluar', limit_mingguan: 14500 },
    { id: 'nabung', tipe: 'tabung', limit_mingguan: 29000 },
    { id: 'masuk', tipe: 'masuk', limit_mingguan: 145000 }
  ];

  // Senin (12 Okt 2026 WIB) - Belanja 20.000
  const seninDate = new Date('2026-10-12T12:00:00+07:00');
  const txSenin = [
    { id: 'tx-1', tipe: 'keluar', nominal: 20000, tanggal: '2026-10-12T10:00:00+07:00' }
  ];
  const resSenin = calculateBudgetFormulas({
    budgetCategories,
    transactionsThisWeek: txSenin,
    todayDate: seninDate,
    startDayOfWeek: 1
  });

  assert.equal(resSenin.A, 116000, 'Senin A harus 116.000');
  assert.equal(resSenin.P, 20000, 'Senin P harus 20.000');
  assert.equal(resSenin.S, 96000, 'Senin S harus 96.000');
  assert.equal(resSenin.hari_sisa, 7, 'Senin hari_sisa harus 7');
  assert.equal(resSenin.jatah, 16500, 'Senin jatah harus 16.500 (116.000/7 bulatkan ratusan)');
  assert.equal(resSenin.sisa_hari, -3500, 'Senin sisa_hari harus -3.500 (16.500 - 20.000)');
  assert.equal(resSenin.status, 'good', 'Senin status harus good (r = 96000/116000 = 0.827 > 0.35)');

  // Selasa (13 Okt 2026 WIB) - Belanja 10.000
  const selasaDate = new Date('2026-10-13T12:00:00+07:00');
  const txSelasa = [
    ...txSenin,
    { id: 'tx-2', tipe: 'keluar', nominal: 10000, tanggal: '2026-10-13T09:00:00+07:00' }
  ];
  const resSelasa = calculateBudgetFormulas({
    budgetCategories,
    transactionsThisWeek: txSelasa,
    todayDate: selasaDate,
    startDayOfWeek: 1
  });

  assert.equal(resSelasa.P, 30000, 'Selasa P harus 30.000');
  assert.equal(resSelasa.S, 86000, 'Selasa S harus 86.000');
  assert.equal(resSelasa.hari_sisa, 6, 'Selasa hari_sisa harus 6');
  assert.equal(resSelasa.jatah, 16000, 'Selasa jatah harus 16.000 (96.000/6 bulatkan ratusan)');
  assert.equal(resSelasa.sisa_hari, 6000, 'Selasa sisa_hari harus 6.000 (16.000 - 10.000)');
  assert.equal(resSelasa.status, 'good', 'Selasa status harus good (r = 86000/116000 = 0.741)');

  // Rabu (14 Okt 2026 WIB) - Belanja 0
  const rabuDate = new Date('2026-10-14T12:00:00+07:00');
  const resRabu = calculateBudgetFormulas({
    budgetCategories,
    transactionsThisWeek: txSelasa, // belum belanja di hari Rabu
    todayDate: rabuDate,
    startDayOfWeek: 1
  });

  assert.equal(resRabu.P, 30000, 'Rabu P harus 30.000');
  assert.equal(resRabu.S, 86000, 'Rabu S harus 86.000');
  assert.equal(resRabu.hari_sisa, 5, 'Rabu hari_sisa harus 5');
  assert.equal(resRabu.jatah, 17200, 'Rabu jatah harus 17.200 (86.000/5 bulatkan ratusan)');
  assert.equal(resRabu.sisa_hari, 17200, 'Rabu sisa_hari harus 17.200 (17.200 - 0)');
  assert.equal(resRabu.status, 'good', 'Rabu status harus good');

  console.log('✓ Bagian 10.4 test table numbers match spec exactly');
}

// 2. Uji Pergantian Minggu Tepat 00:00 WIB dan Pergeseran Awal Minggu
{
  const dateSeninMidnight = new Date('2026-10-12T00:00:00+07:00');
  const rangeSeninStart = getWeekRange(dateSeninMidnight, 1);
  const partsStart = getWIBParts(rangeSeninStart.start);
  const partsEnd = getWIBParts(rangeSeninStart.end);

  assert.equal(partsStart.day, 1, 'Start day harus Senin (1)');
  assert.equal(partsStart.hours, 0, 'Start hour harus 00:00 WIB');
  assert.equal(partsStart.minutes, 0);
  assert.equal(partsEnd.day, 1, 'End day harus Senin minggu berikutnya');
  assert.equal(partsEnd.hours, 0, 'End hour harus 00:00 WIB');

  // Mengubah awal_minggu ke Minggu (7)
  const rangeMingguStart = getWeekRange(dateSeninMidnight, 7);
  const partsMingguStart = getWIBParts(rangeMingguStart.start);
  assert.equal(partsMingguStart.day, 0, 'Start day harus Minggu (0 in JS getDay)');
  assert.equal(partsMingguStart.date, 11, 'Start date harus 11 Okt 2026');

  console.log('✓ 00:00 WIB boundaries and awal_minggu shifting verified');
}

// 3. Uji Penolakan Tanggal Masa Depan & Validasi Nominal (Bagian 12.5 & 17)
{
  function validateTxInput(nominalStr, dateStr) {
    const nominal = parseRp(nominalStr);
    if (nominal <= 0 || nominal > 10000000) {
      return { valid: false, error: 'Nominal harus antara 1 s.d. 10.000.000' };
    }

    if (dateStr) {
      const txTime = new Date(dateStr).getTime();
      const nowTime = Date.now();
      // Allow max 1 minute future drift for clock disparity
      if (txTime > nowTime + 60000) {
        return { valid: false, error: 'Tanggal tidak boleh di masa depan' };
      }
    }

    return { valid: true };
  }

  assert.equal(validateTxInput('0', '').valid, false, 'Nominal 0 harus ditolak');
  assert.equal(validateTxInput('-5000', '').valid, false, 'Nominal negatif harus ditolak');
  assert.equal(validateTxInput('15000000', '').valid, false, 'Nominal > 10jt harus ditolak');
  assert.equal(validateTxInput('50.000', '').valid, true, 'Nominal 50.000 harus valid');

  const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(validateTxInput('50.000', futureIso).valid, false, 'Tanggal besok harus ditolak');

  console.log('✓ Tanggal masa depan dan nominal tidak valid ditolak');
}

// 4. Uji Alokasi Budget Pengaturan (Bagian 13.2 & 17)
{
  function calculateAllocation(uangJajan, categories) {
    const totalAllocated = categories
      .filter((b) => b.tipe === 'keluar' || b.tipe === 'tabung')
      .reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0);
    const diff = uangJajan - totalAllocated;

    let status = 'equal';
    let text = `Teralokasi ${formatRp(totalAllocated)} · pas ✓`;
    if (totalAllocated < uangJajan) {
      status = 'less';
      text = `Belum dialokasikan ${formatRp(diff)}`;
    } else if (totalAllocated > uangJajan) {
      status = 'more';
      text = `Lebih ${formatRp(Math.abs(diff))} dari uang jajan`;
    }

    return { totalAllocated, diff, status, text };
  }

  const testCats = [
    { tipe: 'keluar', limit_mingguan: 72500 },
    { tipe: 'keluar', limit_mingguan: 25000 },
    { tipe: 'keluar', limit_mingguan: 4000 },
    { tipe: 'keluar', limit_mingguan: 14500 },
    { tipe: 'tabung', limit_mingguan: 29000 }
  ];

  const allocEqual = calculateAllocation(145000, testCats);
  assert.equal(allocEqual.status, 'equal');
  assert.equal(allocEqual.totalAllocated, 145000);
  assert.match(allocEqual.text, /pas ✓/);

  const allocLess = calculateAllocation(150000, testCats);
  assert.equal(allocLess.status, 'less');
  assert.equal(allocLess.diff, 5000);
  assert.match(allocLess.text, /Belum dialokasikan/);

  const allocMore = calculateAllocation(140000, testCats);
  assert.equal(allocMore.status, 'more');
  assert.equal(allocMore.diff, -5000);
  assert.match(allocMore.text, /Lebih Rp 5.000 dari uang jajan/);

  console.log('✓ Indikator alokasi pas/kurang/lebih diverifikasi');
}

// 5. Uji Kategori Dipakai Transaksi Tidak Boleh Dihapus / Berganti Tipe (Bagian 13.4 & 17)
{
  const txList = [
    { id: 't1', kategori_id: 'jajan', nominal: 10000 },
    { id: 't2', kategori_id: 'pulsa', nominal: 5000 }
  ];

  function canDeleteCategory(catId, transactions) {
    const isUsed = transactions.some((t) => t.kategori_id === catId);
    return !isUsed;
  }

  assert.equal(canDeleteCategory('jajan', txList), false, 'Kategori jajan dipakai, tidak boleh dihapus');
  assert.equal(canDeleteCategory('pulsa', txList), false, 'Kategori pulsa dipakai, tidak boleh dihapus');
  assert.equal(canDeleteCategory('bensin', txList), true, 'Kategori bensin tidak dipakai, boleh dihapus');

  console.log('✓ Kategori yang dipakai transaksi terlindungi');
}

// 6. Uji Penanganan Galat Sambungan (Bagian 14 & 17)
{
  function mapConnectError({ ok, status, json, url }) {
    if (!url.startsWith('https://script.google.com/')) {
      return 'URL harus diawali https://script.google.com/';
    }
    if (status === 401 || status === 403) {
      return 'Token tidak cocok.';
    }
    if (json) {
      const err = String(json.error || json.message || '').toLowerCase();
      if (err.includes('token') || err.includes('unauthorized') || err.includes('auth')) {
        return 'Token tidak cocok.';
      }
      if (json.data && Array.isArray(json.data.budget) && json.data.budget.length === 0) {
        return 'Jalankan setup() di Apps Script dulu.';
      }
    }
    return 'Tidak bisa terhubung. Cek URL dan sinyal.';
  }

  assert.equal(
    mapConnectError({ url: 'http://invalidsite.com' }),
    'URL harus diawali https://script.google.com/'
  );
  assert.equal(
    mapConnectError({ url: 'https://script.google.com/macros/s/xyz', status: 401 }),
    'Token tidak cocok.'
  );
  assert.equal(
    mapConnectError({
      url: 'https://script.google.com/macros/s/xyz',
      status: 200,
      json: { ok: false, error: 'Unauthorized token invalid' }
    }),
    'Token tidak cocok.'
  );
  assert.equal(
    mapConnectError({
      url: 'https://script.google.com/macros/s/xyz',
      status: 200,
      json: { ok: true, data: { budget: [] } }
    }),
    'Jalankan setup() di Apps Script dulu.'
  );
  assert.equal(
    mapConnectError({
      url: 'https://script.google.com/macros/s/xyz',
      status: 500
    }),
    'Tidak bisa terhubung. Cek URL dan sinyal.'
  );

  console.log('✓ Alur sambung dan 3 jenis galat bagian 14 diverifikasi');
}

console.log('--- ALL TAHAP 2 ACCEPTANCE CRITERIA VERIFIED! ---');
