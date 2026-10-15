import assert from 'node:assert/strict';
import {
  getTimePhase,
  calculateStreak,
  calculateBadges,
  BADGES_DEFINITION,
  INDO_DAYS_SHORT
} from '../src/lib/gamification.js';
import { createWIBDate, toWIBISOString } from '../src/lib/week.js';

console.log('--- RUNNING TAHAP 4 GAMIFICATION TESTS ---');

// ==========================================
// 1. TIME OF DAY RESOLVER (PRD 24.2)
// ==========================================
{
  // 1.1 Pagi: 05:00 - 10:59
  const tPagiStart = new Date('2026-10-14T05:00:00+07:00');
  const tPagiMid = new Date('2026-10-14T08:30:00+07:00');
  const tPagiEnd = new Date('2026-10-14T10:59:59+07:00');

  for (const t of [tPagiStart, tPagiMid, tPagiEnd]) {
    const res = getTimePhase(t);
    assert.equal(res.phase, 'pagi');
    assert.equal(res.skyTop, '#BFE3EA');
    assert.equal(res.skyBottom, '#FFE9C7');
    assert.equal(res.grass, '#B9D8A2');
    assert.equal(res.celestial, 'sun');
    assert.equal(res.creatures, 'birds');
  }

  // 1.2 Siang: 11:00 - 15:59
  const tSiangStart = new Date('2026-10-14T11:00:00+07:00');
  const tSiangMid = new Date('2026-10-14T13:45:00+07:00');
  const tSiangEnd = new Date('2026-10-14T15:59:59+07:00');

  for (const t of [tSiangStart, tSiangMid, tSiangEnd]) {
    const res = getTimePhase(t);
    assert.equal(res.phase, 'siang');
    assert.equal(res.skyTop, '#9ECFE0');
    assert.equal(res.skyBottom, '#E3F1E4');
    assert.equal(res.grass, '#B5D6A0');
    assert.equal(res.celestial, 'clouds');
    assert.equal(res.creatures, 'butterflies');
  }

  // 1.3 Senja: 16:00 - 18:29
  const tSenjaStart = new Date('2026-10-14T16:00:00+07:00');
  const tSenjaMid = new Date('2026-10-14T17:15:00+07:00');
  const tSenjaEnd = new Date('2026-10-14T18:29:59+07:00');

  for (const t of [tSenjaStart, tSenjaMid, tSenjaEnd]) {
    const res = getTimePhase(t);
    assert.equal(res.phase, 'senja');
    assert.equal(res.skyTop, '#F6C9A8');
    assert.equal(res.skyBottom, '#C9A7D6');
    assert.equal(res.grass, '#A3C28A');
    assert.equal(res.celestial, 'sun_orange');
    assert.equal(res.creatures, 'birds_return');
  }

  // 1.4 Malam: 18:30 - 04:59
  const tMalamStart = new Date('2026-10-14T18:30:00+07:00');
  const tMalamMid = new Date('2026-10-14T23:00:00+07:00');
  const tMalamLate = new Date('2026-10-15T02:00:00+07:00');
  const tMalamEnd = new Date('2026-10-15T04:59:59+07:00');

  for (const t of [tMalamStart, tMalamMid, tMalamLate, tMalamEnd]) {
    const res = getTimePhase(t);
    assert.equal(res.phase, 'malam');
    assert.equal(res.skyTop, '#2F3F6B');
    assert.equal(res.skyBottom, '#5A6A99');
    assert.equal(res.grass, '#6F8F7A');
    assert.equal(res.celestial, 'moon_stars');
    assert.equal(res.creatures, 'fireflies');
  }

  console.log('✓ Time phase boundaries (Pagi, Siang, Senja, Malam) match PRD 24.2');
}

// ==========================================
// 2. STREAK HARI HEMAT (PRD Section 23)
// ==========================================
{
  const now = new Date('2026-10-15T20:00:00+07:00'); // Kamis 20:00 WIB
  // Batas harian = Math.floor(116000 / 7 / 100) * 100 = 16.500

  // 2.1 Basic streak with consecutive thrift days
  const txsBasic = [
    { id: 't1', tipe: 'keluar', nominal: 10000, tanggal: '2026-10-12T10:00:00+07:00' }, // Senin: hemat
    { id: 't2', tipe: 'keluar', nominal: 15000, tanggal: '2026-10-13T12:00:00+07:00' }, // Selasa: hemat
    { id: 't3', tipe: 'keluar', nominal: 12000, tanggal: '2026-10-14T14:00:00+07:00' }  // Rabu: hemat
  ];

  const streak1 = calculateStreak({
    transactions: txsBasic,
    totalWeeklyLimit: 116000,
    now
  });

  assert.equal(streak1.batasHarian, 16500, 'Batas harian default 16.500');
  assert.equal(streak1.currentStreak, 3, 'Current streak 3 hari');
  assert.equal(streak1.bestStreak, 3, 'Best streak 3 hari');
  assert.equal(streak1.streakTitle, '3 hari hemat');

  // 2.2 Neutral skipping on "hari kosong" (does not break, does not increment)
  const txsWithKosong = [
    { id: 't1', tipe: 'keluar', nominal: 10000, tanggal: '2026-10-10T10:00:00+07:00' }, // Sabtu: hemat
    { id: 't2', tipe: 'keluar', nominal: 14000, tanggal: '2026-10-11T10:00:00+07:00' }, // Minggu: hemat
    // 2026-10-12: KOSONG (tanpa tx, tanpa tanda) -> netral dilewati
    { id: 't3', tipe: 'keluar', nominal: 12000, tanggal: '2026-10-13T10:00:00+07:00' }, // Selasa: hemat
    { id: 't4', tipe: 'keluar', nominal: 15000, tanggal: '2026-10-14T10:00:00+07:00' }  // Rabu: hemat
  ];

  const streak2 = calculateStreak({
    transactions: txsWithKosong,
    now
  });
  assert.equal(streak2.currentStreak, 4, 'Kosong dilewati netral: total 4 hari hemat');
  assert.equal(streak2.bestStreak, 4);

  // 2.3 "Hari lewat" memutus streak
  const txsWithLewat = [
    { id: 't1', tipe: 'keluar', nominal: 10000, tanggal: '2026-10-11T10:00:00+07:00' }, // Minggu: hemat
    { id: 't2', tipe: 'keluar', nominal: 25000, tanggal: '2026-10-12T10:00:00+07:00' }, // Senin: lewat (25k > 16.5k) memutus streak!
    { id: 't3', tipe: 'keluar', nominal: 12000, tanggal: '2026-10-13T10:00:00+07:00' }, // Selasa: hemat
    { id: 't4', tipe: 'keluar', nominal: 15000, tanggal: '2026-10-14T10:00:00+07:00' }  // Rabu: hemat
  ];

  const streak3 = calculateStreak({
    transactions: txsWithLewat,
    now
  });
  assert.equal(streak3.currentStreak, 2, 'Lewat memutus streak: hanya 2 hari terakhir');
  assert.equal(streak3.bestStreak, 2);

  // 2.4 History with higher previous best streak
  const txsLongHistory = [
    { id: 't1', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-01T10:00:00+07:00' }, // 1: hemat
    { id: 't2', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-02T10:00:00+07:00' }, // 2: hemat
    { id: 't3', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-03T10:00:00+07:00' }, // 3: hemat
    { id: 't4', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-04T10:00:00+07:00' }, // 4: hemat
    { id: 't5', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-05T10:00:00+07:00' }, // 5: hemat (rekor 5)
    { id: 't6', tipe: 'keluar', nominal: 30000, tanggal: '2026-10-06T10:00:00+07:00' }, // 6: lewat!
    { id: 't7', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-14T10:00:00+07:00' }  // 14: hemat (current 1)
  ];

  const streak4 = calculateStreak({
    transactions: txsLongHistory,
    now
  });
  assert.equal(streak4.currentStreak, 1, 'Current streak is 1');
  assert.equal(streak4.bestStreak, 5, 'Best streak retains historic 5');

  // 2.5 "Tanpa Jajan" support (PRD 23.3)
  const streakTanpaJajan = calculateStreak({
    transactions: [
      { id: 't1', tipe: 'keluar', nominal: 10000, tanggal: '2026-10-12T10:00:00+07:00' },
      { id: 't3', tipe: 'keluar', nominal: 10000, tanggal: '2026-10-14T10:00:00+07:00' }
    ],
    tanpaJajan: '2026-10-13', // 13 Oktober ditandai tanpa jajan
    now
  });
  assert.equal(streakTanpaJajan.currentStreak, 3, 'Hari tanpa jajan dihitung sebagai hari hemat');

  // 2.6 canMarkTanpaJajanToday criteria (PRD 23.3)
  // At 20:00 with 0 keluar tx and not marked -> TRUE
  assert.equal(streak1.canMarkTanpaJajanToday, true);

  // At 14:00 (before 18:00) -> FALSE
  const streakEarly = calculateStreak({
    transactions: [],
    now: new Date('2026-10-15T14:00:00+07:00')
  });
  assert.equal(streakEarly.canMarkTanpaJajanToday, false);

  // With keluar tx today -> FALSE
  const streakWithTodayKeluar = calculateStreak({
    transactions: [
      { id: 't1', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-15T10:00:00+07:00' }
    ],
    now
  });
  assert.equal(streakWithTodayKeluar.canMarkTanpaJajanToday, false);

  // Already marked -> FALSE
  const streakAlreadyMarked = calculateStreak({
    transactions: [],
    tanpaJajan: '2026-10-15',
    now
  });
  assert.equal(streakAlreadyMarked.canMarkTanpaJajanToday, false);

  // 2.7 last7Days format & symbols (PRD 23.4)
  assert.equal(streak1.last7Days.length, 7);
  const todayItem = streak1.last7Days[6];
  assert.equal(todayItem.dateStr, '2026-10-15');
  assert.equal(todayItem.symbol, '◌');
  assert.equal(todayItem.type, 'today');

  const rabuItem = streak1.last7Days[5];
  assert.equal(rabuItem.dateStr, '2026-10-14');
  assert.equal(rabuItem.symbol, '🐾');
  assert.equal(rabuItem.type, 'hemat');

  // Streak 0 title
  const zeroStreak = calculateStreak({ transactions: [], now });
  assert.equal(zeroStreak.currentStreak, 0);
  assert.equal(zeroStreak.streakTitle, 'Ayo mulai hari hemat pertama');

  console.log('✓ Streak calculation, neutral skipping, tanpa jajan, and symbols verified');
}

// ==========================================
// 3. BADGES ENGINE (PRD Section 25)
// ==========================================
{
  // 3.1 10 Definitions verified
  assert.equal(BADGES_DEFINITION.length, 10);
  assert.deepEqual(
    BADGES_DEFINITION.map((b) => b.id),
    [
      'first_tx',
      'week_active',
      'streak_3',
      'streak_7',
      'streak_30',
      'perfect_week',
      'first_saving',
      'goal_reached',
      'savings_100k',
      'savings_500k'
    ]
  );

  // 3.2 Empty data -> 0 badges unlocked
  const emptyRes = calculateBadges({ transactions: [], budgets: [], goals: [] });
  assert.equal(emptyRes.unlockedCount, 0);
  assert.equal(emptyRes.length, 10);
  assert.ok(emptyRes.every((b) => !b.unlocked));

  // 3.3 first_tx
  const nowForFirstTx = new Date('2026-10-01T12:00:00+07:00');
  const res1 = calculateBadges({
    transactions: [{ id: 't1', tipe: 'keluar', nominal: 5000, tanggal: '2026-10-01T10:00:00+07:00' }],
    now: nowForFirstTx
  });
  assert.equal(res1.find((b) => b.id === 'first_tx').unlocked, true);
  assert.equal(res1.find((b) => b.id === 'first_tx').progressText, 'Selesai');
  assert.equal(res1.unlockedCount, 1);

  // 3.4 week_active (7 consecutive active days)
  const weekActiveTxs = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    id: `tx-${day}`,
    tipe: 'keluar',
    nominal: 5000,
    tanggal: `2026-10-0${day}T10:00:00+07:00`
  }));
  const resWeekActive = calculateBadges({ transactions: weekActiveTxs });
  assert.equal(resWeekActive.find((b) => b.id === 'week_active').unlocked, true);
  assert.equal(resWeekActive.find((b) => b.id === 'week_active').progressText, 'Selesai');

  // 3.5 Streak badges: streak_3, streak_7, streak_30
  const resStreak3 = calculateBadges({ streak: { bestStreak: 3 } });
  assert.equal(resStreak3.find((b) => b.id === 'streak_3').unlocked, true);
  assert.equal(resStreak3.find((b) => b.id === 'streak_7').unlocked, false);
  assert.equal(resStreak3.find((b) => b.id === 'streak_7').progressText, '3/7 hari');

  const resStreak7 = calculateBadges({ streak: 7 });
  assert.equal(resStreak7.find((b) => b.id === 'streak_7').unlocked, true);
  assert.equal(resStreak7.find((b) => b.id === 'streak_30').unlocked, false);

  const resStreak30 = calculateBadges({ streak: 32 });
  assert.equal(resStreak30.find((b) => b.id === 'streak_30').unlocked, true);

  // 3.6 perfect_week
  // Completed week (2026-10-05 Mon to 2026-10-12 Mon) with total 40.000 <= 116.000 and 0 over categories
  const nowOct15 = new Date('2026-10-15T12:00:00+07:00');
  const perfectWeekTxs = [
    { id: 'pw1', tipe: 'keluar', kategori_id: 'jajan', nominal: 20000, tanggal: '2026-10-06T10:00:00+07:00' },
    { id: 'pw2', tipe: 'keluar', kategori_id: 'pulsa', nominal: 20000, tanggal: '2026-10-08T10:00:00+07:00' }
  ];
  const budgets = [
    { id: 'jajan', tipe: 'keluar', limit_mingguan: 50000 },
    { id: 'pulsa', tipe: 'keluar', limit_mingguan: 30000 }
  ];
  const resPerfectWeek = calculateBadges({
    transactions: perfectWeekTxs,
    budgets,
    totalWeeklyLimit: 80000,
    now: nowOct15
  });
  assert.equal(resPerfectWeek.find((b) => b.id === 'perfect_week').unlocked, true);

  // 3.7 first_saving
  const resFirstSaving = calculateBadges({
    transactions: [{ id: 's1', tipe: 'tabung', nominal: 10000, tanggal: '2026-10-01T10:00:00+07:00' }]
  });
  assert.equal(resFirstSaving.find((b) => b.id === 'first_saving').unlocked, true);

  // 3.8 goal_reached
  const resGoalReached = calculateBadges({
    goals: [{ id: 'g1', nama: 'Sepatu', target: 50000 }],
    transactions: [{ id: 's1', tipe: 'tabung', goal_id: 'g1', nominal: 50000, tanggal: '2026-10-02T10:00:00+07:00' }]
  });
  assert.equal(resGoalReached.find((b) => b.id === 'goal_reached').unlocked, true);

  // 3.9 savings_100k & savings_500k
  const resSavings100k = calculateBadges({
    transactions: [{ id: 's1', tipe: 'tabung', nominal: 120000, tanggal: '2026-10-02T10:00:00+07:00' }]
  });
  assert.equal(resSavings100k.find((b) => b.id === 'savings_100k').unlocked, true);
  assert.equal(resSavings100k.find((b) => b.id === 'savings_500k').unlocked, false);

  const resSavings500k = calculateBadges({
    transactions: [{ id: 's1', tipe: 'tabung', nominal: 550000, tanggal: '2026-10-02T10:00:00+07:00' }]
  });
  assert.equal(resSavings500k.find((b) => b.id === 'savings_500k').unlocked, true);

  console.log('✓ All 10 Badges unlock criteria verified');
}

// ==========================================
// 4. TANGGAL SYNC TO SPREADSHEET (PRD 5.4, 12.3 & Apps Script)
// ==========================================
{
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

  // 4.1 Today WIB ISO formatting
  const now = new Date('2026-10-15T15:30:45+07:00');
  const nowISO = toWIBISOString(now);
  assert.equal(nowISO, '2026-10-15T15:30:45+07:00');
  assert.ok(ISO_RE.test(nowISO), 'Today ISO matches Apps Script ISO_RE regex');

  // 4.2 Yesterday noon WIB
  const yesterday = createWIBDate(2026, 9, 14); // 14 Oct (month index 9)
  const yesterdayNoon = new Date(yesterday.getTime() + 12 * 60 * 60 * 1000);
  const yesterdayISO = toWIBISOString(yesterdayNoon);
  assert.equal(yesterdayISO, '2026-10-14T12:00:00+07:00');
  assert.ok(ISO_RE.test(yesterdayISO), 'Yesterday ISO matches Apps Script ISO_RE regex');

  // 4.3 Custom date noon WIB
  const customDay = createWIBDate(2026, 9, 5); // 5 Oct 2026
  const customNoon = new Date(customDay.getTime() + 12 * 60 * 60 * 1000);
  const customISO = toWIBISOString(customNoon);
  assert.equal(customISO, '2026-10-05T12:00:00+07:00');
  assert.ok(ISO_RE.test(customISO), 'Custom ISO matches Apps Script ISO_RE regex');

  // 4.4 Verify payload column mapping for Transaksi
  const SHEETS_TRANSAKSI = ['id', 'tanggal', 'tipe', 'kategori_id', 'nominal', 'catatan', 'goal_id'];
  const txPayload = {
    id: 'tx_test_123',
    tanggal: customISO,
    tipe: 'keluar',
    kategori_id: 'makan',
    nominal: 25000,
    catatan: 'Nasi goreng',
    goal_id: ''
  };

  const rowValues = SHEETS_TRANSAKSI.map(h => (txPayload[h] === undefined || txPayload[h] === null) ? '' : txPayload[h]);
  assert.equal(rowValues[0], 'tx_test_123');
  assert.equal(rowValues[1], '2026-10-05T12:00:00+07:00', 'Tanggal persis berada di kolom ke-2 (B) spreadsheet');
  assert.equal(rowValues[2], 'keluar');
  assert.equal(rowValues[3], 'makan');
  assert.equal(rowValues[4], 25000);

  console.log('✓ Tanggal input and spreadsheet column mapping verified');
}

console.log('--- ALL TAHAP 4 ACCEPTANCE CRITERIA VERIFIED! ---');
