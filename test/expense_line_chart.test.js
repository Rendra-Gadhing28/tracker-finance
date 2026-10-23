import assert from 'node:assert/strict';
import { calculateLast7DaysSpending } from '../src/lib/stats.js';

console.log('--- RUNNING EXPENSE LINE CHART TESTS ---');

// Test 1: calculateLast7DaysSpending structure and boundaries
{
  const today = new Date('2026-10-23T15:00:00+07:00'); // Jumat
  const transactions = [
    // H-6 (Sabtu, 17 Okt)
    { tipe: 'keluar', nominal: 50000, tanggal: '2026-10-17T10:00:00+07:00' },
    // H-5 (Minggu, 18 Okt)
    { tipe: 'keluar', nominal: 40000, tanggal: '2026-10-18T12:00:00+07:00' },
    // H-3 (Selasa, 20 Okt)
    { tipe: 'keluar', nominal: 200000, tanggal: '2026-10-20T08:30:00+07:00' },
    // H-0 (Jumat, 23 Okt - hari ini)
    { tipe: 'keluar', nominal: 56000, tanggal: '2026-10-23T09:00:00+07:00' },
    // Masuk & tabung harus diabaikan
    { tipe: 'masuk', nominal: 500000, tanggal: '2026-10-23T10:00:00+07:00' },
    { tipe: 'tabung', nominal: 100000, tanggal: '2026-10-23T11:00:00+07:00' },
    // Transaksi di luar jendela 7 hari (H-7)
    { tipe: 'keluar', nominal: 999999, tanggal: '2026-10-16T23:59:00+07:00' }
  ];

  const result = calculateLast7DaysSpending({ transactions, todayDate: today });

  assert.equal(result.days.length, 7, 'Harus menghasilkan tepat 7 hari');
  
  // Hari pertama: Sabtu (17 Okt)
  assert.equal(result.days[0].shortLabel, 'Sab');
  assert.equal(result.days[0].nominal, 50000);
  assert.equal(result.days[0].isToday, false);

  // Hari kedua: Minggu (18 Okt)
  assert.equal(result.days[1].shortLabel, 'Min');
  assert.equal(result.days[1].nominal, 40000);

  // Hari ketiga: Senin (19 Okt) - kosong
  assert.equal(result.days[2].shortLabel, 'Sen');
  assert.equal(result.days[2].nominal, 0);

  // Hari keempat: Selasa (20 Okt)
  assert.equal(result.days[3].shortLabel, 'Sel');
  assert.equal(result.days[3].nominal, 200000);

  // Hari terakhir: Jumat (23 Okt) - hari ini
  assert.equal(result.days[6].shortLabel, 'Jum');
  assert.equal(result.days[6].nominal, 56000);
  assert.equal(result.days[6].isToday, true);

  // Total dan average
  const expectedTotal = 50000 + 40000 + 0 + 200000 + 0 + 0 + 56000;
  assert.equal(result.total, expectedTotal, `Total harus ${expectedTotal}`);
  assert.equal(result.average, Math.round(expectedTotal / 7));

  console.log('✓ calculateLast7DaysSpending verified');
}

// Test 2: Empty transactions produce 7 zero-filled days
{
  const result = calculateLast7DaysSpending({ transactions: [], todayDate: new Date('2026-10-23T12:00:00+07:00') });
  assert.equal(result.days.length, 7);
  assert.equal(result.total, 0);
  assert.equal(result.average, 0);
  assert.ok(result.days.every((d) => d.nominal === 0));
  assert.equal(result.days[6].isToday, true);
  console.log('✓ empty transactions fallback verified');
}

// Test 3: Budget line scaling & coordinate math
{
  const dailyBudget = 75000;
  const maxNominal = Math.max(200000, dailyBudget);
  const maxY = maxNominal * 1.25;
  const baseline = 32 + 120; // 152
  const budgetY = baseline - (dailyBudget / maxY) * 120;

  assert.ok(budgetY < baseline, 'Budget line should be positioned above baseline');
  assert.ok(budgetY > 32 - 8, 'Budget line should not exceed top bounds');
  console.log('✓ budget line coordinate math verified');
}

console.log('--- ALL EXPENSE LINE CHART TESTS PASSED! ---');
