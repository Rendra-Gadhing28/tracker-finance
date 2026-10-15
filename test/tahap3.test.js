import assert from 'node:assert/strict';
import {
  calculateGoalProgress,
  calculateGoalEta,
  calculateGeneralSavings,
  calculateTotalSavings
} from '../src/lib/goals.js';
import {
  getPeriodRange,
  calculateLargestRemainder,
  calculateCategoryBreakdown,
  calculateDailySpending,
  generateInsights,
  calculateDonutAngles,
  calculateStats
} from '../src/lib/stats.js';

console.log('--- RUNNING TAHAP 3 VERIFICATION TESTS ---');

// ==========================================
// 1. GOALS / TABUNGAN (PRD Section 18)
// ==========================================

// 1.1 calculateGoalProgress
{
  const goals = [
    { id: 'g-1', nama: 'Sepatu baru', target: 200000 },
    { id: 'g-2', nama: 'Konsol', target: 350000 },
    { id: 'g-3', nama: 'Jaket', target: 100000 }
  ];

  const transactions = [
    { id: 'tx-1', tipe: 'tabung', goal_id: 'g-1', nominal: 100000 },
    { id: 'tx-2', tipe: 'tabung', goal_id: 'g-1', nominal: 24000 },
    { id: 'tx-3', tipe: 'tabung', goal_id: 'g-2', nominal: 49000 },
    { id: 'tx-4', tipe: 'tabung', goal_id: 'g-3', nominal: 110000 }, // lebih
    { id: 'tx-5', tipe: 'keluar', goal_id: 'g-1', nominal: 50000 } // keluar diabaikan
  ];

  const progress = calculateGoalProgress(goals, transactions);

  // g-1: 124.000 / 200.000 (PRD 18.3 contoh: 62%)
  const g1 = progress.find((g) => g.id === 'g-1');
  assert.equal(g1.terkumpul, 124000, 'g-1 terkumpul 124.000');
  assert.equal(g1.rawPersen, 62, 'g-1 rawPersen 62');
  assert.equal(g1.persen, 62, 'g-1 persen 62%');
  assert.equal(g1.barPersen, 62, 'g-1 barPersen 62');
  assert.equal(g1.isAchieved, false, 'g-1 belum tercapai');
  assert.equal(g1.lebih, 0, 'g-1 kelebihan 0');

  // g-2: 49.000 / 350.000 (PRD 18.3 contoh: 14%)
  const g2 = progress.find((g) => g.id === 'g-2');
  assert.equal(g2.terkumpul, 49000, 'g-2 terkumpul 49.000');
  assert.equal(g2.persen, 14, 'g-2 persen 14%');
  assert.equal(g2.isAchieved, false);

  // g-3: 110.000 / 100.000 -> 110%, barPersen 100, lebih 10.000
  const g3 = progress.find((g) => g.id === 'g-3');
  assert.equal(g3.terkumpul, 110000, 'g-3 terkumpul 110.000');
  assert.ok(Math.abs(g3.rawPersen - 110) < 0.0001, 'g-3 rawPersen 110');
  assert.equal(g3.persen, 110, 'g-3 persen 110%');
  assert.equal(g3.barPersen, 100, 'g-3 barPersen mentok 100');
  assert.equal(g3.isAchieved, true, 'g-3 tercapai');
  assert.equal(g3.lebih, 10000, 'g-3 lebih 10.000');

  console.log('✓ Goal progress calculations match PRD Section 18 formulas');
}

// 1.2 calculateGoalEta
{
  const today = new Date('2026-10-13T12:00:00+07:00');
  const goalSepatu = { id: 'g-sepatu', target: 200000, terkumpul: 124000 };

  // Kasus A: Kurang dari 2 setoran dalam 28 hari -> laju = limit nabung (29.000)
  // Sisa 76.000 / 29.000 = 2.62 -> ceil = 3 minggu (PRD 18.3: "± 3 minggu lagi")
  const txSatuSetoran = [
    { id: 'tx-1', tipe: 'tabung', goal_id: 'g-sepatu', nominal: 10000, tanggal: '2026-10-10T10:00:00+07:00' }
  ];
  const etaDefault = calculateGoalEta({
    goal: goalSepatu,
    transactions: txSatuSetoran,
    budgetNabungLimit: 29000,
    todayDate: today
  });
  assert.equal(etaDefault.laju, 29000, 'Laju harus fallback ke limit nabung 29.000');
  assert.equal(etaDefault.minggu, 3, 'Estimasi minggu harus 3');
  assert.equal(etaDefault.text, '± 3 minggu lagi');

  // Kasus B: >= 2 setoran dalam 28 hari -> laju = total / 4
  // 2 setoran @ 20.000 = 40.000 -> laju = 10.000. Sisa 76.000 / 10.000 = 7.6 -> ceil = 8 minggu
  const txDuaSetoran = [
    { id: 'tx-1', tipe: 'tabung', goal_id: 'g-sepatu', nominal: 20000, tanggal: '2026-10-05T10:00:00+07:00' },
    { id: 'tx-2', tipe: 'tabung', goal_id: 'g-sepatu', nominal: 20000, tanggal: '2026-10-10T10:00:00+07:00' }
  ];
  const etaDua = calculateGoalEta({
    goal: goalSepatu,
    transactions: txDuaSetoran,
    budgetNabungLimit: 29000,
    todayDate: today
  });
  assert.equal(etaDua.laju, 10000, 'Laju harus 40.000 / 4 = 10.000');
  assert.equal(etaDua.minggu, 8, 'Estimasi minggu harus 8');
  assert.equal(etaDua.text, '± 8 minggu lagi');

  // Kasus C: Sudah tercapai -> return null
  const goalTercapai = { id: 'g-done', target: 100000, terkumpul: 100000 };
  const etaDone = calculateGoalEta({
    goal: goalTercapai,
    transactions: [],
    todayDate: today
  });
  assert.equal(etaDone, null, 'Goal tercapai mengembalikan null');

  // Kasus D: Laju <= 0 -> return { laju: 0, minggu: null, text: '—' }
  const goalNol = { id: 'g-nol', target: 50000, terkumpul: 0 };
  const etaNol = calculateGoalEta({
    goal: goalNol,
    transactions: [],
    budgetNabungLimit: 0,
    todayDate: today
  });
  assert.equal(etaNol.laju, 0);
  assert.equal(etaNol.minggu, null);
  assert.equal(etaNol.text, '—');

  console.log('✓ Goal ETA formula matches PRD 18.2 criteria');
}

// 1.3 calculateGeneralSavings & calculateTotalSavings
{
  const activeGoals = [{ id: 'g-1', nama: 'Sepatu' }];
  const transactions = [
    { id: 'tx-1', tipe: 'tabung', goal_id: 'g-1', nominal: 100000, tanggal: '2026-10-01T10:00:00+07:00' },
    { id: 'tx-2', tipe: 'tabung', goal_id: null, nominal: 30000, tanggal: '2026-10-13T10:00:00+07:00' }, // umum
    { id: 'tx-3', tipe: 'tabung', goal_id: 'g-deleted', nominal: 14000, tanggal: '2026-10-14T10:00:00+07:00' }, // umum
    { id: 'tx-4', tipe: 'tabung', goal_id: 'g-1', nominal: 5000, tanggal: '2026-10-15T10:00:00+07:00' }, // minggu ini
    { id: 'tx-5', tipe: 'keluar', nominal: 20000, tanggal: '2026-10-13T10:00:00+07:00' } // bukan tabung
  ];

  // Tabungan umum (PRD 18.3 contoh: Rp 44.000 = 30.000 + 14.000)
  const tabunganUmum = calculateGeneralSavings(activeGoals, transactions);
  assert.equal(tabunganUmum, 44000, 'Tabungan umum harus 44.000');

  // Total savings (PRD 18.3 contoh: Total ditabung 217.000, Minggu ini 5.000 / 29.000 = 17%)
  const weekStart = new Date('2026-10-12T00:00:00+07:00');
  const weekEnd = new Date('2026-10-19T00:00:00+07:00');

  const savingsTotal = calculateTotalSavings(transactions, weekStart, weekEnd, 29000);
  assert.equal(savingsTotal.totalAllTime, 149000, 'Total seluruh waktu');
  assert.equal(savingsTotal.totalMingguIni, 49000, 'Total minggu ini (30k + 14k + 5k)');

  // Uji spesifik contoh PRD 18.3: 5.000 / 29.000 = 17%
  const prdExTx = [
    { id: 'tx-old', tipe: 'tabung', nominal: 212000, tanggal: '2026-10-01T00:00:00+07:00' },
    { id: 'tx-now', tipe: 'tabung', nominal: 5000, tanggal: '2026-10-13T00:00:00+07:00' }
  ];
  const resPrd = calculateTotalSavings(prdExTx, weekStart, weekEnd, 29000);
  assert.equal(resPrd.totalAllTime, 217000, 'Total ditabung 217.000');
  assert.equal(resPrd.totalMingguIni, 5000, 'Minggu ini 5.000');
  assert.equal(resPrd.persenMingguIni, 17, 'Persen minggu ini 17% (5.000/29.000 round)');

  console.log('✓ Tabungan umum & Total savings match PRD Section 18.3');
}

// ==========================================
// 2. STATISTIK & LOGIKA DATA (PRD Section 19)
// ==========================================

// 2.1 getPeriodRange
{
  const selasaDate = new Date('2026-10-13T12:00:00+07:00');

  // Minggu berjalan
  const rangeWeek = getPeriodRange('minggu', selasaDate, 1, 0);
  assert.equal(rangeWeek.isCurrent, true, 'isCurrent harus true saat offset 0');
  assert.equal(rangeWeek.label, '12–18 Okt 2026', 'Label minggu berjalan harus "12–18 Okt 2026"');

  // Minggu lalu (offset -1)
  const rangeWeekPrev = getPeriodRange('minggu', selasaDate, 1, -1);
  assert.equal(rangeWeekPrev.isCurrent, false, 'isCurrent harus false saat offset -1');
  assert.equal(rangeWeekPrev.label, '5–11 Okt 2026');

  // Bulan berjalan
  const rangeMonth = getPeriodRange('bulan', selasaDate, 1, 0);
  assert.equal(rangeMonth.isCurrent, true);
  assert.equal(rangeMonth.label, 'Okt 2026');
  assert.equal(rangeMonth.start.toISOString(), new Date('2026-10-01T00:00:00+07:00').toISOString());
  assert.equal(rangeMonth.end.toISOString(), new Date('2026-11-01T00:00:00+07:00').toISOString());

  console.log('✓ getPeriodRange properly handles WIB weeks and calendar months');
}

// 2.2 calculateLargestRemainder (Hare-Niemeyer)
{
  // Kasus pembagian seimbang dengan sisa 1:
  // 10 / 30 = 33.333% masing-masing -> sum integer = 99 -> 1 kursi dibagikan ke sisa terbesar pertama
  const items = [
    { id: 'a', nominal: 10 },
    { id: 'b', nominal: 10 },
    { id: 'c', nominal: 10 }
  ];
  const res = calculateLargestRemainder(items);
  const sumPersen = res.reduce((sum, i) => sum + i.persen, 0);
  assert.equal(sumPersen, 100, 'Jumlah persen Hare-Niemeyer harus tepat 100%');
  assert.deepEqual(res.map((i) => i.persen), [34, 33, 33], 'Satu kursi +1 terdistribusi rapi');

  // Kasus banyak item dan total 0
  const zeroRes = calculateLargestRemainder([{ id: 'z1', nominal: 0 }, { id: 'z2', nominal: 0 }]);
  assert.equal(zeroRes[0].persen, 0);
  assert.equal(zeroRes[1].persen, 0);

  // Kasus pecahan rumit
  const complexItems = [
    { id: '1', nominal: 12500 },
    { id: '2', nominal: 34100 },
    { id: '3', nominal: 58900 },
    { id: '4', nominal: 7200 }
  ];
  const complexRes = calculateLargestRemainder(complexItems);
  const complexSum = complexRes.reduce((sum, i) => sum + i.persen, 0);
  assert.equal(complexSum, 100, 'Pecahan kompleks harus tepat 100%');

  console.log('✓ Largest Remainder Method guarantees exactly 100% sum');
}

// 2.3 calculateCategoryBreakdown & Max 8 Slicing
{
  const categories = [
    { id: 'c1', nama: 'Makan', limit_mingguan: 50000, tipe: 'keluar' },
    { id: 'c2', nama: 'Bensin', limit_mingguan: 20000, tipe: 'keluar' },
    { id: 'c3', nama: 'Pulsa', limit_mingguan: 10000, tipe: 'keluar' },
    { id: 'c4', nama: 'Kopi', limit_mingguan: 15000, tipe: 'keluar' },
    { id: 'c5', nama: 'Snack', limit_mingguan: 10000, tipe: 'keluar' },
    { id: 'c6', nama: 'Buku', limit_mingguan: 5000, tipe: 'keluar' },
    { id: 'c7', nama: 'Game', limit_mingguan: 5000, tipe: 'keluar' },
    { id: 'c8', nama: 'Pakaian', limit_mingguan: 8000, tipe: 'keluar' },
    { id: 'c9', nama: 'Hobi', limit_mingguan: 7000, tipe: 'keluar' },
    { id: 'c10', nama: 'Gaji', limit_mingguan: 100000, tipe: 'masuk' } // tipe masuk diabaikan
  ];

  const transactions = [
    { kategori_id: 'c1', nominal: 40000, tipe: 'keluar', tanggal: '2026-10-13T10:00:00+07:00' },
    { kategori_id: 'c2', nominal: 25000, tipe: 'keluar', tanggal: '2026-10-13T11:00:00+07:00' },
    { kategori_id: 'c3', nominal: 15000, tipe: 'keluar', tanggal: '2026-10-13T12:00:00+07:00' },
    { kategori_id: 'c4', nominal: 12000, tipe: 'keluar', tanggal: '2026-10-13T13:00:00+07:00' },
    { kategori_id: 'c5', nominal: 8000, tipe: 'keluar', tanggal: '2026-10-13T14:00:00+07:00' },
    { kategori_id: 'c6', nominal: 6000, tipe: 'keluar', tanggal: '2026-10-13T15:00:00+07:00' },
    { kategori_id: 'c7', nominal: 4000, tipe: 'keluar', tanggal: '2026-10-13T16:00:00+07:00' },
    { kategori_id: 'c8', nominal: 3000, tipe: 'keluar', tanggal: '2026-10-13T17:00:00+07:00' },
    { kategori_id: 'c9', nominal: 2000, tipe: 'keluar', tanggal: '2026-10-13T18:00:00+07:00' }
  ];

  const periodRange = {
    start: new Date('2026-10-12T00:00:00+07:00'),
    end: new Date('2026-10-19T00:00:00+07:00'),
    isMonth: false
  };

  const breakdown = calculateCategoryBreakdown({
    categories,
    transactions,
    periodRange,
    mode: 'terpakai'
  });

  // Ada 9 kategori keluar; maksimal 8 irisan (top 7 + Lainnya)
  assert.equal(breakdown.items.length, 8, 'Kategori harus dipotong menjadi maksimal 8 item');
  const lainnyaItem = breakdown.items[7];
  assert.equal(lainnyaItem.id, 'lainnya', 'Item ke-8 harus berupa Lainnya');
  assert.equal(lainnyaItem.nama, 'Lainnya');
  assert.equal(lainnyaItem.ikon, '🏷️');
  assert.deepEqual(lainnyaItem.color, { fill: '#F0EBE1', border: '#D5CBBB' });

  // c8 (3.000) + c9 (2.000) digabung menjadi 5.000
  assert.equal(lainnyaItem.nominal, 5000, 'Nominal Lainnya adalah gabungan sisa kategori (3k + 2k)');

  // Sum of percentages must equal 100%
  const totalPersen = breakdown.items.reduce((sum, i) => sum + i.persen, 0);
  assert.equal(totalPersen, 100, 'Total persen breakdown harus tepat 100%');

  // Uji mode rencana untuk bulan (limit * 4)
  const monthBreakdown = calculateCategoryBreakdown({
    categories,
    transactions,
    periodRange: {
      start: new Date('2026-10-01T00:00:00+07:00'),
      end: new Date('2026-11-01T00:00:00+07:00'),
      isMonth: true
    },
    mode: 'rencana'
  });
  const c1Month = monthBreakdown.items.find((c) => c.id === 'c1');
  assert.equal(c1Month.nominal, 200000, 'Nominal rencana bulanan harus limit * 4 (50.000 * 4 = 200.000)');

  console.log('✓ Category breakdown & max 8 slicing logic verified');
}

// 2.4 calculateDailySpending
{
  const today = new Date('2026-10-13T12:00:00+07:00'); // Selasa
  const periodRange = {
    start: new Date('2026-10-12T00:00:00+07:00'), // Senin
    end: new Date('2026-10-19T00:00:00+07:00')
  };

  const transactions = [
    { tipe: 'keluar', nominal: 25000, tanggal: '2026-10-12T10:00:00+07:00' }, // Senin
    { tipe: 'keluar', nominal: 10000, tanggal: '2026-10-13T09:00:00+07:00' }, // Selasa
    { tipe: 'tabung', nominal: 5000, tanggal: '2026-10-13T10:00:00+07:00' }, // Tabung diabaikan di daily keluar
    { tipe: 'keluar', nominal: 30000, tanggal: '2026-10-14T10:00:00+07:00' } // Rabu (masa depan)
  ];

  const bars = calculateDailySpending({
    transactions,
    periodRange,
    isMonth: false,
    averageBudget: 16500,
    startDayOfWeek: 1,
    todayDate: today
  });

  assert.equal(bars.length, 7, 'Minggu harus menghasilkan 7 batang');

  // Senin (12 Okt): 25.000 > 16.500 -> isOverBudget true, isFuture false
  assert.equal(bars[0].label, 'Senin');
  assert.equal(bars[0].nominal, 25000);
  assert.equal(bars[0].isOverBudget, true);
  assert.equal(bars[0].isFuture, false);

  // Selasa (13 Okt): 10.000 <= 16.500 -> isOverBudget false, isFuture false
  assert.equal(bars[1].label, 'Selasa');
  assert.equal(bars[1].nominal, 10000);
  assert.equal(bars[1].isOverBudget, false);
  assert.equal(bars[1].isFuture, false);

  // Rabu (14 Okt): Masa depan -> isFuture true, nominal 0
  assert.equal(bars[2].label, 'Rabu');
  assert.equal(bars[2].nominal, 0, 'Hari masa depan tinggi batang harus 0');
  assert.equal(bars[2].isFuture, true, 'Hari masa depan ditandai isFuture: true');

  console.log('✓ Daily spending bars, future dates & budget thresholds verified');
}

// 2.5 generateInsights (PRD Section 19.7)
{
  // Skenario 1: Terboros > 50% dan Ada kategori lewat limit
  const breakdown = {
    items: [
      { id: 'jajan', nama: 'Jajan & makan', nominal: 62000, terpakaiNominal: 62000, rencanaNominal: 72500, tipe: 'keluar' },
      { id: 'pulsa', nama: 'Pulsa', nominal: 5000, terpakaiNominal: 5000, rencanaNominal: 4000, tipe: 'keluar' }, // Lewat 1.000
      { id: 'bensin', nama: 'Bensin', nominal: 25000, terpakaiNominal: 25000, rencanaNominal: 25000, tipe: 'keluar' }
    ]
  };
  // Total keluar = 62.000 + 5.000 + 25.000 = 92.000. Jajan = 62.000 (67.4% > 50%)

  const dailyBars = [
    { label: 'Senin', nominal: 20000, isFuture: false },
    { label: 'Selasa', nominal: 50000, isFuture: false },
    { label: 'Rabu', nominal: 22000, isFuture: false }
  ];

  const insights = generateInsights({
    breakdown,
    dailyBars,
    budgetSummary: { S: 15000 },
    mode: 'terpakai'
  });

  // Maksimal 2 baris insight mengikuti prioritas 1 lalu 2
  assert.equal(insights.length, 2, 'Insight dibatasi maksimal 2 item');
  assert.equal(insights[0], 'Terboros: Jajan & makan (67%)', 'Prioritas 1: Kategori > 50%');
  assert.equal(insights[1], 'Pulsa lewat Rp 1.000 dari rencana', 'Prioritas 2: Kategori lewat limit');

  // Skenario 2: Tidak ada yang > 50%, ambil Prioritas 2 dan Prioritas 3 (Hari terboros)
  const breakdown2 = {
    items: [
      { id: 'jajan', nama: 'Jajan & makan', nominal: 40000, terpakaiNominal: 40000, rencanaNominal: 50000, tipe: 'keluar' },
      { id: 'pulsa', nama: 'Pulsa', nominal: 35000, terpakaiNominal: 35000, rencanaNominal: 30000, tipe: 'keluar' }, // Lewat 5.000
      { id: 'bensin', nama: 'Bensin', nominal: 25000, terpakaiNominal: 25000, rencanaNominal: 25000, tipe: 'keluar' }
    ]
  };
  const dailyBars2 = [
    { label: 'Senin', nominal: 10000, isFuture: false },
    { label: 'Selasa', nominal: 15000, isFuture: false },
    { label: 'Sabtu', nominal: 45000, isFuture: false }
  ];

  const insights2 = generateInsights({
    breakdown: breakdown2,
    dailyBars: dailyBars2,
    budgetSummary: null,
    mode: 'terpakai'
  });

  assert.equal(insights2.length, 2);
  assert.equal(insights2[0], 'Pulsa lewat Rp 5.000 dari rencana', 'Prioritas 2 di baris 1');
  assert.equal(insights2[1], 'Hari terboros: Sabtu', 'Prioritas 3: Hari terboros (>= 3 hari data)');

  // Skenario 3: Hemat dari rencana (Prioritas 4)
  const breakdown3 = {
    items: [
      { id: 'jajan', nama: 'Jajan & makan', nominal: 20000, terpakaiNominal: 20000, rencanaNominal: 30000, tipe: 'keluar' },
      { id: 'bensin', nama: 'Bensin', nominal: 20000, terpakaiNominal: 20000, rencanaNominal: 30000, tipe: 'keluar' }
    ]
  };
  const insights3 = generateInsights({
    breakdown: breakdown3,
    dailyBars: [{ label: 'Senin', nominal: 40000, isFuture: false }], // Hanya 1 hari data (< 3)
    budgetSummary: { S: 20000 },
    mode: 'terpakai'
  });
  assert.equal(insights3.length, 1);
  assert.equal(insights3[0], 'Hemat Rp 20.000 dari rencana', 'Prioritas 4: Hemat dari rencana');

  console.log('✓ generateInsights priority rules & 2-line capping verified');
}

// 2.6 calculateDonutAngles: 1 irisan persis 360° tanpa celah & abaikan Rp 0 (PRD 19.9)
{
  const single = calculateDonutAngles([{ id: 'c1', nama: 'Jajan', nominal: 50000 }], 50000);
  assert.equal(single.length, 1, 'Hanya ada 1 irisan');
  assert.equal(single[0].startAngle, 0, 'startAngle harus 0');
  assert.equal(single[0].endAngle, 360, 'endAngle harus 360');
  assert.equal(single[0].angle, 360, 'angle harus persis 360 tanpa celah 2°');

  // Mengabaikan irisan nominal 0
  const withZero = calculateDonutAngles([
    { id: 'c1', nama: 'Jajan', nominal: 50000 },
    { id: 'c2', nama: 'Pulsa', nominal: 0 }
  ], 50000);
  assert.equal(withZero.length, 1, 'Irisan nominal 0 harus disaring');
  assert.equal(withZero[0].angle, 360, 'Irisan tersisa tetap 360°');

  console.log('✓ 1 irisan menghasilkan persis 360° tanpa celah dan mengabaikan Rp 0');
}

// 2.7 Transaksi dengan kategori_id tak dikenal masuk ke 'Lainnya' (PRD 19.9)
{
  const categories = [
    { id: 'jajan', nama: 'Jajan & makan', limit_mingguan: 70000, tipe: 'keluar' }
  ];
  const transactions = [
    { kategori_id: 'jajan', nominal: 30000, tipe: 'keluar', tanggal: '2026-10-13T10:00:00+07:00' },
    { kategori_id: 'unknown_ghost_cat', nominal: 15000, tipe: 'keluar', tanggal: '2026-10-13T11:00:00+07:00' },
    { kategori_id: null, nominal: 5000, tipe: 'keluar', tanggal: '2026-10-13T12:00:00+07:00' }
  ];
  const periodRange = {
    start: new Date('2026-10-12T00:00:00+07:00'),
    end: new Date('2026-10-19T00:00:00+07:00'),
    isMonth: false
  };

  const breakdown = calculateCategoryBreakdown({
    categories,
    transactions,
    periodRange,
    mode: 'terpakai'
  });

  const lainnya = breakdown.items.find((i) => i.id === 'lainnya');
  assert.ok(lainnya, 'Item Lainnya harus otomatis dibuat untuk kategori tak dikenal');
  assert.equal(lainnya.nominal, 20000, 'Nominal Lainnya harus menjumlahkan transaksi tak dikenal (15k + 5k = 20k)');
  assert.equal(breakdown.total, 50000, 'Total seluruh kategori harus 50.000');

  console.log('✓ Transaksi kategori tak dikenal masuk ke Lainnya (PRD 19.9)');
}

// 2.8 Urutan slices mengikuti urut kategori sedangkan categoryList mengikuti nominal descending
{
  const budgets = [
    { id: 'pulsa', nama: 'Pulsa', limit_mingguan: 10000, tipe: 'keluar', urut: 1 },
    { id: 'jajan', nama: 'Jajan & makan', limit_mingguan: 80000, tipe: 'keluar', urut: 2 },
    { id: 'bensin', nama: 'Bensin', limit_mingguan: 30000, tipe: 'keluar', urut: 3 }
  ];

  // Pengeluaran: Pulsa = 10.000, Jajan = 50.000, Bensin = 25.000
  const transactions = [
    { kategori_id: 'pulsa', nominal: 10000, tipe: 'keluar', tanggal: '2026-10-13T10:00:00+07:00' },
    { kategori_id: 'jajan', nominal: 50000, tipe: 'keluar', tanggal: '2026-10-13T11:00:00+07:00' },
    { kategori_id: 'bensin', nominal: 25000, tipe: 'keluar', tanggal: '2026-10-13T12:00:00+07:00' }
  ];

  const stats = calculateStats({
    budgets,
    transactions,
    period: 'minggu',
    mode: 'terpakai',
    now: new Date('2026-10-13T12:00:00+07:00')
  });

  // PRD 19.5: categoryList diurutkan nominal terbesar dulu: Jajan (50k) > Bensin (25k) > Pulsa (10k)
  assert.deepEqual(
    stats.categoryList.map((c) => c.id),
    ['jajan', 'bensin', 'pulsa'],
    'categoryList diurutkan nominal descending'
  );

  // PRD 19.4: slices diurutkan berdasarkan 'urut' kategori searah jarum jam mulai jam 12: Pulsa (urut 1) -> Jajan (urut 2) -> Bensin (urut 3)
  assert.deepEqual(
    stats.slices.map((s) => s.id),
    ['pulsa', 'jajan', 'bensin'],
    'slices diurutkan berdasarkan urut kategori'
  );

  console.log('✓ Urutan slices mengikuti urut kategori & categoryList mengikuti nominal descending');
}

// 2.9 Ambang batas jatah rata-rata menggunakan A (kategori keluar saja)
{
  const budgets = [
    { id: 'jajan', limit_mingguan: 72500, tipe: 'keluar' },
    { id: 'pulsa', limit_mingguan: 4000, tipe: 'keluar' },
    { id: 'bensin', limit_mingguan: 25000, tipe: 'keluar' },
    { id: 'jajanin', limit_mingguan: 14500, tipe: 'keluar' },
    { id: 'nabung', limit_mingguan: 29000, tipe: 'tabung' }, // Tabung bukan keluar
    { id: 'masuk', limit_mingguan: 145000, tipe: 'masuk' } // Masuk bukan keluar
  ];
  // A = 72.500 + 4.000 + 25.000 + 14.500 = 116.000

  const stats = calculateStats({
    budgets,
    transactions: [],
    period: 'minggu',
    mode: 'terpakai',
    now: new Date('2026-10-13T12:00:00+07:00')
  });

  // Jatah harian rata-rata per PRD 19.6: A / 7 = 116.000 / 7 = 16.571
  const expectedThreshold = Math.round(116000 / 7);
  assert.equal(
    stats.dailyBars[0].threshold,
    expectedThreshold,
    'Threshold harian harus Math.round(A / 7) di mana A hanya kategori keluar'
  );
  assert.equal(stats.dailySpending.averageBudget, expectedThreshold);

  console.log('✓ Ambang batas jatah rata-rata menggunakan A (hanya kategori keluar)');
}

// ==========================================
// 3. SUBPHASE 3.2: TABUNGAN & GOALS UI VERIFICATION
// ==========================================
{
  const { readFileSync } = await import('node:fs');

  // 3.1 GoalSheet.svelte
  const goalSheetSrc = readFileSync('src/lib/components/GoalSheet.svelte', 'utf8');
  const expectedIcons = ['🍙', '🍜', '🍰', '🥤', '🍱', '🍕', '☕', '🍔', '📱', '⛽', '🚗', '🛵', '🚌', '🎁', '🛒', '📚', '🎮', '🎬', '🐷', '💰', '💵', '🏷️', '⭐', '🐾'];
  for (const icon of expectedIcons) {
    assert.ok(goalSheetSrc.includes(icon), `GoalSheet must contain icon ${icon}`);
  }
  assert.ok(goalSheetSrc.includes('existingGoalsCount >= 10'), 'GoalSheet handles existingGoalsCount >= 10');
  assert.ok(goalSheetSrc.includes('Maksimal 10 target'), 'GoalSheet has Maksimal 10 target label');
  assert.ok(goalSheetSrc.includes('setoran akan menjadi tabungan umum'), 'GoalSheet has delete confirmation per PRD 18.5');
  assert.ok(goalSheetSrc.includes('goal_'), 'GoalSheet generates goal_ id format');

  // 3.2 tabungan/+page.svelte
  const tabunganPageSrc = readFileSync('src/routes/tabungan/+page.svelte', 'utf8');
  assert.ok(tabunganPageSrc.includes('calculateTotalSavings'), 'tabungan/+page uses calculateTotalSavings');
  assert.ok(tabunganPageSrc.includes('calculateGeneralSavings'), 'tabungan/+page uses calculateGeneralSavings');
  assert.ok(tabunganPageSrc.includes('calculateGoalEta'), 'tabungan/+page uses calculateGoalEta');
  assert.ok(tabunganPageSrc.includes('goto(`/tabungan/'), 'tabungan/+page routes to detail');
  assert.ok(tabunganPageSrc.includes('walking-cat'), 'tabungan/+page includes walking cat marker');
  assert.ok(tabunganPageSrc.includes('🏁'), 'tabungan/+page includes finish flag');
  assert.ok(tabunganPageSrc.includes('Tercapai'), 'tabungan/+page includes Tercapai section');
  assert.ok(tabunganPageSrc.includes('Belum ada target'), 'tabungan/+page includes empty state');

  // 3.3 tabungan/[id]/+page.svelte
  const detailPageSrc = readFileSync('src/routes/tabungan/[id]/+page.svelte', 'utf8');
  assert.ok(detailPageSrc.includes('page.params.id'), 'detail page reads page.params.id');
  assert.ok(detailPageSrc.includes('QUICK_AMOUNTS'), 'detail page has quick chips');
  assert.ok(detailPageSrc.includes('hero-split-card'), 'detail page has split hero card');
  assert.ok(detailPageSrc.includes('canvas-confetti'), 'detail page imports canvas-confetti');
  assert.ok(detailPageSrc.includes('celebrated_goal_'), 'detail page tracks celebration in localStorage');
  assert.ok(detailPageSrc.includes('Target tercapai!'), 'detail page shows Target tercapai! banner');
  assert.ok(detailPageSrc.includes('Disetor'), 'detail page shows Disetor snackbar');
  assert.ok(detailPageSrc.includes('Nominal lain'), 'detail page has Nominal lain button');

  console.log('✓ Subphase 3.2 Tabungan & Goals UI components verified');
}

console.log('--- ALL TAHAP 3 ACCEPTANCE CRITERIA VERIFIED! ---');
